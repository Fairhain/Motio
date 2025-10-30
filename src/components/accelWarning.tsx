import { PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = PropsWithChildren<{
  isVisible: boolean;
  onClose: () => void;
  autoHideMs?: number;
}>;


export default function AccelWarning({isVisible, children, onClose, autoHideMs = 2500 }: Props) {

    return (
        <Modal transparent visible={isVisible} animationType="none" onRequestClose={onClose}>
            <Pressable onPress={onClose}>
                <View style={[styles.container]}>
                <Text style={styles.text}>Speeding up too fast!</Text>
                </View>
            </Pressable>
        </Modal>
    )
}

const styles = StyleSheet.create({
    
    container: {
        marginHorizontal: "auto",
        marginTop: 200,
        padding: 10,
        borderRadius: 5,
        backgroundColor: "red",
    },
    text: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
    }
})