"use client";

import React from "react";
import { CustomTimePicker, CustomTimePickerProps } from "./CustomTimePicker";

export type TimePickerProps = CustomTimePickerProps;

export const TimePicker: React.FC<TimePickerProps> = (props) => {
  return <CustomTimePicker {...props} />;
};

TimePicker.displayName = "TimePicker";

export { CustomTimePicker };
