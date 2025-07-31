import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  conversations: [],
  messages: {}, // { [conversationId]: [mesajlar] }
  typing: {}, // { [conversationId]: userId }
  loading: false,
  activeChatId: null,
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
      if (!state.messages[conversationId]) state.messages[conversationId] = [];
      state.messages[conversationId].push(message);
    },
    setTyping: (state, action) => {
      state.typing[action.payload.conversationId] = action.payload.userId;
    },
    clearTyping: (state, action) => {
      delete state.typing[action.payload.conversationId];
    },
    setActiveChat: (state, action) => {
      state.activeChatId = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const {
  setConversations,
  setMessages,
  addMessage,
  setTyping,
  clearTyping,
  setActiveChat,
  setLoading,
} = chatSlice.actions;
export default chatSlice.reducer;
