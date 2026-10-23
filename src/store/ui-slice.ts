import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UiState = { mobileDrawerOpen: boolean; ideaWizardStep: number };

const uiSlice = createSlice({
  name: "ui",
  initialState: { mobileDrawerOpen: false, ideaWizardStep: 1 } as UiState,
  reducers: {
    setMobileDrawerOpen(state, action: PayloadAction<boolean>) {
      state.mobileDrawerOpen = action.payload;
    },
    setIdeaWizardStep(state, action: PayloadAction<number>) {
      state.ideaWizardStep = Math.min(5, Math.max(1, action.payload));
    },
    resetIdeaWizard(state) {
      state.ideaWizardStep = 1;
    },
  },
});

export const { setMobileDrawerOpen, setIdeaWizardStep, resetIdeaWizard } = uiSlice.actions;
export default uiSlice.reducer;
