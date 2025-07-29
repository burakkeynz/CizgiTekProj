import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  inCall: false, // Şu an arama var mı
  incoming: null, // Gelen arama teklifi varsa (data objesi)
  peerUser: null, // Arama yapılan ya da arayan user objesi
  callType: null, // "video" veya "audio"
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    startCall: (state, action) => {
      state.inCall = true;
      state.callType = action.payload.type; // "video" veya "audio"
      state.peerUser = action.payload.peerUser; // { id, name, ... }
      state.incoming = null;
    },
    receiveCall: (state, action) => {
      state.inCall = false;
      state.incoming = action.payload; // data (webrtc_offer)
      state.callType = action.payload.call_type;
      state.peerUser = action.payload.from_user || null;
    },
    answerCall: (state) => {
      state.inCall = true;
      state.incoming = null;
    },
    endCall: (state) => {
      state.inCall = false;
      state.incoming = null;
      state.peerUser = null;
      state.callType = null;
    },
  },
});

export const { startCall, receiveCall, answerCall, endCall } =
  callSlice.actions;
export default callSlice.reducer;
