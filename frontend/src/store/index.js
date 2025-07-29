import { configureStore } from "@reduxjs/toolkit";
import callReducer from "./callSlice";
import chatReducer from "./chatSlice";

const store = configureStore({
  reducer: {
    call: callReducer,
    chat: chatReducer,
  },
});

export default store;
