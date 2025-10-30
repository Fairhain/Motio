import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";

export default function Graph({data, title}: {data: number[], title?: string}) {
    const makePoints = () => {
        const n = data.length;
        if (n === 0) return '';
        const stepX = n > 1 ? 300 / (n - 1) : 300;

        // clamp & scale to height (0 at bottom)
        const pts: string[] = [];
        for (let i = 0; i < n; i++) {
            const x = i * stepX;
            const v = Math.max(-5, Math.min(5, data[i]));
            const y = 100 - (v / 5) * 100;
            pts.push(`${x},${y}`);
        }
        return pts.join(' ');
    };

    const points = makePoints();
    return (
        <View style={styles.container}>
            <Text>{title ? title : "Graph"} (last {data.length} samples)</Text>
            <Svg height="200" width="300">
                <Polyline
                    points={points}
                    fill="none"
                    stroke="blue"
                    strokeWidth="2"
                />
                <Line x1="0" y1="100" x2="300" y2="100" stroke="black" strokeWidth="1" />
            </Svg>
        </View>
    )
}


const styles = StyleSheet.create({
    container: {
        alignSelf: "center"
    }
})