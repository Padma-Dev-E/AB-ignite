import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UiState = { mobileDrawerOpen: boolean };

const uiSlice = createSlice({
  name: "ui",
  initialState: { mobileDrawerOpen: false } as UiState,
  reducers: {
    setMobileDrawerOpen(state, action: PayloadAction<boolean>) {
      state.mobileDrawerOpen = action.payload;
    },
  },
});

export const { setMobileDrawerOpen } = uiSlice.actions;
export default uiSlice.reducer;
