import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  inCall: false, // Aktif görüşme var mı
  incoming: null, // Gelen arama teklifi
  peerUser: null, // Karşıdaki kişi objesi
  callType: null, // "video" | "audio"
  isStarter: false, // Aramayı başlatan taraf mıyız
  micOn: true, // Görüşme sırasında mikrofon açık mı
  camOn: true, // Görüşme sırasında kamera açık mı
  chat_id: null,
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    startCall: (state, action) => {
      console.log("[DEBUG][SLICE][startCall] action:", action, "state:", state);
      state.inCall = true;
      state.callType = action.payload.type;
      state.peerUser = action.payload.peerUser;
      state.incoming = null;
      state.isStarter = true;
      state.chat_id = action.payload.chat_id ?? null;
    },
    receiveCall: (state, action) => {
      console.log(
        "[DEBUG][SLICE][receiveCall] action.payload:",
        action.payload
      );
      state.inCall = false;
      state.incoming = action.payload;
      state.callType = action.payload.call_type;
      state.peerUser = action.payload.from_user || null;
      state.isStarter = false;
      state.chat_id = action.payload.chat_id ?? null;
    },
    answerCall: (state) => {
      console.log("[DEBUG][SLICE][answerCall] state:", state);
      state.inCall = true;
      // state.incoming = null;
      state.isStarter = false;
    },
    endCall: (state) => {
      console.log("[DEBUG][SLICE][endCall] state:", state);
      // SADECE TEK END CALL!
      state.inCall = false;
      state.incoming = null;
      state.peerUser = null;
      state.callType = null;
      state.isStarter = false;
      state.micOn = true;
      state.camOn = true;
      state.chat_id = null;
    },
    toggleMic: (state) => {
      state.micOn = !state.micOn;
    },
    toggleCam: (state) => {
      state.camOn = !state.camOn;
    },
  },
});

export const {
  startCall,
  receiveCall,
  answerCall,
  endCall,
  toggleMic,
  toggleCam,
} = callSlice.actions;
export default callSlice.reducer;
