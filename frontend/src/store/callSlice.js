import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  inCall: false, // Aktif görüşme var mı
  incoming: null, // Gelen arama teklifi
  peerUser: null, // Karşıdaki kişi
  callType: null, // "video" | "audio"
  isStarter: false, // Aramayı başlatan taraf mıyız
  micOn: true,
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    startCall: (state, action) => {
      state.inCall = true;
      state.callType = action.payload.type;
      state.peerUser = action.payload.peerUser;
      state.incoming = null;
      state.isStarter = true;
    },
    receiveCall: (state, action) => {
      state.inCall = false;
      state.incoming = action.payload;
      state.callType = action.payload.call_type;
      state.peerUser = action.payload.from_user || null;
      state.isStarter = false;
    },
    answerCall: (state) => {
      state.inCall = true;
      state.incoming = null;
      state.isStarter = false;
    },
    endCall: (state) => {
      state.inCall = false;
      state.incoming = null;
      state.peerUser = null;
      state.callType = null;
      state.isStarter = false;
    },
    toggleMic: (state) => {
      state.micOn = !state.micOn;
    },
    toggleCam: (state) => {
      state.camOn = !state.camOn;
    },
    endCall: (state) => {
      state.inCall = false;
      state.incoming = null;
      state.peerUser = null;
      state.callType = null;
      state.isStarter = false;
      state.micOn = true; // call bitince reset
      state.camOn = true;
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
