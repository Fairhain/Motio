import os
import math
import asyncio
from datetime import datetime, timezone
from typing import Optional, Literal
from openai import OpenAI

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, confloat
from dateutil import parser as dateparser
from timezonefinder import TimezoneFinder
import pytz
from fastapi.middleware.cors import CORSMiddleware


print("Backend is running!")

class EventIn(BaseModel):
    session_id: Optional[str] = None
    lat: float
    lng: float
 
    timestamp: Optional[float | str] = Field(..., description="Unix seconds (float) or ISO string")
    speed_mps: Optional[float] = None
    ax: Optional[float] = None
    ay: Optional[float] = None
    az: Optional[float] = None
    rotation_rate_z: Optional[float] = None
    event_type: Optional[Literal['hard_brake','rapid_accel','hard_corner','overspeed','other']] = 'other'


class Enriched(BaseModel):
    local_time_iso: str
    time_of_day: Literal['night','dawn','morning','afternoon','evening']
    timezone: str

    road_highway_type: Optional[str] = None 
    speed_limit_mph: Optional[float] = None  

    weather_summary: Optional[str] = None
    temperature_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    wind_mph: Optional[float] = None
    condition_code: Optional[str] = None

class AnalysisOut(BaseModel):
    event: EventIn
    enriched: Enriched
    ai_context: str

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
client = OpenAI(

)



tf = TimezoneFinder()
app = FastAPI()

def parse_timestamp(ts: float | str) -> datetime:
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(float(ts), tz=timezone.utc)
    dt = dateparser.parse(str(ts))
    if not dt.tzinfo:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def get_time_of_day(local_dt: datetime) -> Literal['night','dawn','morning','afternoon','evening']:
    hour = local_dt.hour
    if 5 <= hour < 8:
        return 'dawn'
    elif 8 <= hour < 12:
        return 'morning'
    elif 12 <= hour < 17:
        return 'afternoon'
    elif 17 <= hour < 21:
        return 'evening'
    else:
        return 'night'
    
async def fetch_road_from_overpass(lat: float, lng: float) -> dict:

    query = f"""
    [out:json][timeout:10];
    way(around:30,{lat},{lng})["highway"];
    out tags geom 1;
    """
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(OVERPASS_URL, data={"data": query})
        r.raise_for_status()
        data = r.json()
    elements = data.get("elements", [])
    if not elements:
        return {}

    tags = elements[0].get("tags", {})
    return {
        "name": tags.get("name"),
        "highway": tags.get("highway"),
    }


async def fetch_weather_openmeteo(lat: float, lng: float, when_utc: datetime) -> dict:
    params = {
        "latitude": lat,
        "longitude": lng,
        "hourly": "temperature_2m,precipitation,wind_speed_10m,weather_code",
        "forecast_days": 1,
        "timezone": "auto",
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",          
        "precipitation_unit": "inch",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(OPEN_METEO_URL, params=params)
        r.raise_for_status()
        data = r.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time") or []
    temps = hourly.get("temperature_2m") or []
    precs = hourly.get("precipitation") or []
    winds = hourly.get("wind_speed_10m") or []
    codes = hourly.get("weather_code") or []

    if not times:
        return {}

    target = when_utc.timestamp()
    idx = 0
    best = 1e18

    for i, t in enumerate(times):
        try:
            dt = dateparser.parse(t)
            ts = dt.timestamp()
            d = abs(ts - target)
            if d < best:
                best = d
                idx = i
        except Exception:
            pass

    def safe_get(arr, i):
        try: return arr[i]
        except: return None

    temperature_f = safe_get(temps, idx)
    precipitation_in = safe_get(precs, idx)
    wind_mph = safe_get(winds, idx)
    wcode = safe_get(codes, idx)

    summary_bits = []
    if temperature_f is not None: summary_bits.append(f"{temperature_f:.0f}°F")
    if wind_mph is not None: summary_bits.append(f"wind {wind_mph:.0f} mi/h")
    if precipitation_in is not None and precipitation_in > 0: summary_bits.append(f"{precipitation_in:.1f}in precip")
    summary = ", ".join(summary_bits) or None

    return {
        "summary": summary,
        "temperature_f": temperature_f,
        "precipitation_in": precipitation_in,
        "wind_mph": wind_mph,
        "weather_code": str(wcode) if wcode is not None else None,
    }
def localize_time(lat: float, lng: float, when_utc: datetime) -> tuple[str, str, str]:
    tz_name = tf.timezone_at(lat=lat, lng=lng) or "UTC"
    tz = pytz.timezone(tz_name)
    local_dt = when_utc.astimezone(tz)
    tod = get_time_of_day(local_dt)
    return local_dt.isoformat(), tz_name, tod

async def getEventContext(ts, type, lat, lng ):
    weather = await fetch_weather_openmeteo(lat, lng, ts)
    weather_summary = weather.get("summary", "unknown")

    road = await fetch_road_from_overpass(lat, lng)
    road_type = road.get("highway", "unknown")
    response = await asyncio.to_thread(
        lambda: client.responses.create(
            model="gpt-5-nano",
            input=f"In 2-3 short sentences, just include a paragraph with not headings or bullet points, provide context for why the driver might have made this error (type={type}) "
                f"given weather='{weather_summary}' and road='{road_type}', also provide suggestions to avoid this error in the future. ",
            store=True,
        )
    )

    print(response.output_text);
    return response.output_text


class ContextReq(BaseModel):
    lat: float
    lng: float
    ts: datetime
    type: str
class WeatherReq(BaseModel):
    lat: float
    lng: float
    when_utc: datetime
class PosReq(BaseModel):
    lat: float
    lng: float


app = FastAPI(title="Motio Analysis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/get-weather")
async def get_weather(req: WeatherReq):
    try:
        result = await fetch_weather_openmeteo(req.lat, req.lng, req.when_utc)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/get-road")
async def get_road(req: PosReq):
    try:
        result = await fetch_road_from_overpass(req.lat, req.lng)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-context")
async def get_context(req: ContextReq):

    try:
        result = await getEventContext(req.ts, req.type, req.lat, req.lng)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



