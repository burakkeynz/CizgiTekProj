import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  conversations: [], // Sohbet listesi
  messages: {}, // Her sohbetin mesajları { [conversationId]: [mesajlar] }
  loading: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConversations: (state, action) => {
      state.conversations = action.payload;
    },
    setMessages: (state, action) => {
      const { conversationId, messages } = action.payload;
      state.messages[conversationId] = messages;
    },
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      state.messages[conversationId].push(message);
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    // ihtiyaca göre unread vs
  },
});

export const { setConversations, setMessages, addMessage, setLoading } =
  chatSlice.actions;
export default chatSlice.reducer;
