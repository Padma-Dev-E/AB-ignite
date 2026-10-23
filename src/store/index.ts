import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./ui-slice";

export function makeStore() {
  return configureStore({ reducer: { ui: uiReducer } });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
