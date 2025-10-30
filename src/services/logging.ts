import { quat, vec3 } from 'gl-matrix';
import { getDb } from "./database";
import { sendEvents } from "./firebase/sendSession";


  let yawEma = 0;
  type Sample = {
    ts: number;        
    ax: number; ay: number; az: number; 
    speed: number;           
    rotationRateZ?: number; 
  }
  type DetectOptions = {
    hardBrakeMps2?: number;    
    rapidAccelMps2?: number;   
    lateralMps2?: number;       
    yawAlpha?: number;        
    speedLimitMps?: number | null; 
    overspeedTolerance?: number;
  };
  type Quaternion = { x: number; y: number; z: number; w: number };

  function wrapPi(a:number){ 
    a=(a+Math.PI)%(2*Math.PI); 
    return a<=0?a+Math.PI:a-Math.PI; 
  }

  function rotateByQuat(v: {x:number,y:number,z:number}, q:{x:number,y:number,z:number,w:number}) {
    const {x,y,z,w} = q;
    const vx = v.x, vy = v.y, vz = v.z;
    
    const ix =  w*vx + y*vz - z*vy;
    const iy =  w*vy + z*vx - x*vz;
    const iz =  w*vz + x*vy - y*vx;
    const iw = -x*vx - y*vy - z*vz;
    return {
      x: ix*w + iw*(-x) + iy*(-z) - iz*(-y),
      y: iy*w + iw*(-y) + iz*(-x) - ix*(-z),
      z: iz*w + iw*(-z) + ix*(-y) - iy*(-x),
    };
  }

  function quatFromEulerZXY(alpha: number, beta: number, gamma: number) {
    const q = quat.create();
    const qz = quat.setAxisAngle(quat.create(), vec3.fromValues(0,0,1), alpha);
    const qx = quat.setAxisAngle(quat.create(), vec3.fromValues(1,0,0), beta);
    const qy = quat.setAxisAngle(quat.create(), vec3.fromValues(0,1,0), gamma);
    quat.mul(q, qz, qx);
    quat.mul(q, q, qy);
    return q as unknown as Quaternion;
  }
  let headingRad = 0

  let lastT = 0;
  export function detectEvents(
    sample: Sample,
    opts: DetectOptions = {},
    rotation: {alpha: number,
          gamma: number,
          beta: number}
  ) {
    const rotAsQuat = quatFromEulerZXY(rotation.alpha, rotation.beta, rotation.gamma)
    const {
      hardBrakeMps2 = -3.0,
      rapidAccelMps2 = +3.0,
      lateralMps2 = 3.0,
      yawAlpha = 0.25,
      speedLimitMps = null,
      overspeedTolerance = 0.0,
    } = opts;

    const dt = (sample.ts - lastT) / 1000;
    const events: any[] = [];

    if (dt > 0 && sample.speed > 2) {

      const rawYaw = sample.rotationRateZ ?? 0;
      yawEma = yawEma + yawAlpha * (rawYaw - yawEma); 

      const a_world = rotateByQuat({x: sample.ax, y: sample.ay, z: sample.az}, rotAsQuat);
      const a_horiz = { x: a_world.x, y: a_world.y };
      headingRad = wrapPi(headingRad + yawEma * dt);


      const f = {x: Math.cos(headingRad), y: Math.sin(headingRad)};
      const lon = a_horiz.x*f.x + a_horiz.y*f.y;         
      const lat = a_horiz.x*(-f.y) + a_horiz.y*(f.x); 


    if (sample.speed >= 4) {
        if (lon < hardBrakeMps2) {
          events.push({ ts: sample.ts, type: 'hard_brake', value: lon, v: sample.speed });
        }
        if (lon > rapidAccelMps2) {
          events.push({ ts: sample.ts, type: 'rapid_accel', value: lon, v: sample.speed });
        }

    }

      
      const lateralApprox = Math.abs(lat); 
      if (lateralApprox > lateralMps2) {
        events.push({ ts: sample.ts, type: 'hard_corner', value: lateralApprox, v: sample.speed });
      }

      if (sample.speed >= 6) {
        const a_est = sample.speed * Math.abs(yawEma);

        if (a_est > lateralMps2) {
          events.push({
            ts: sample.ts,
            type: 'too_fast_turn',
            value: a_est,         
            yawRate: yawEma,    
            v: sample.speed      
          });
        }
      }

      if (speedLimitMps != null && sample.speed > speedLimitMps + overspeedTolerance) {
        events.push({
          ts: sample.ts,
          type: 'overspeed',
          value: sample.speed,   
          limit: speedLimitMps
        });
      }
    }

    lastT = sample.ts;
    return events;
  }


export async function appendSamples(
  sessionId: string,
  samples: Array<{ ts: number; speed: number; ax: number; ay: number; az: number }>
) {
  
  const db = await (await getDb)();
  await db.execAsync('BEGIN');
  try {
    for (const s of samples) {
      await db.runAsync(
        'INSERT INTO samples(session_id, ts, speed, ax, ay, az) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, s.ts, s.speed, s.ax, s.ay, s.az]
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}


export async function appendEvents(
  sessionId: string,
  events: Array<{ ts:number; type:string; value:number; lat:number; lng:number }>
) {
  if (!events.length) return;
  const db = await (await getDb)();
  await db.execAsync('BEGIN');
  try {
    for (const e of events) {

      await sendEvents({lat: e.lat, lng: e.lng})
      await db.runAsync(
        'INSERT INTO events(session_id, ts, type, value, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, e.ts, e.type, e.value, e.lat, e.lng]
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) { await db.execAsync('ROLLBACK'); throw e; }
}

export async function appendTrack(
  sessionId: string,
  points: Array<{ ts: number; lat: number; lng: number }>
) {
  if (!points.length) return;
  const db = await (await getDb)();
  await db.execAsync('BEGIN');
  try {
    for (const p of points) {
      await db.runAsync(
        'INSERT INTO track(session_id, ts, lat, lng) VALUES (?, ?, ?, ?)',
        [sessionId, p.ts, p.lat, p.lng]
      );
    }
    await db.execAsync('COMMIT');
  } catch (e) { await db.execAsync('ROLLBACK'); throw e; }
}