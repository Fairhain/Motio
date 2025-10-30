import { StyleSheet } from 'react-native';

export const COLORS = {
  bg: '#FFF9F5',
  card: '#FFFFFF',
  text: '#333333',
  subtext: '#555555',
  brand: '#FF7A00',
  brandDark: '#E86F00',
  border: '#EAD9CE',
  success: '#15da15',
  paused: '#919191',
  danger: '#FF3B30',
};

export const mainStyle = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: 60
    },
    sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 340,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderTopWidth: 1,
    borderColor: COLORS.border,

  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#333333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
    marginTop: 4,
  },
  link: {
    color: "#FF7A00",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
})