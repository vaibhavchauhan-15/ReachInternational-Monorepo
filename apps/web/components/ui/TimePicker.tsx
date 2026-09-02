"use client";

import React from "react";
import {
  CustomTimePicker,
  CustomTimePickerProps,
  TimeInput,
  TimeInputProps,
} from "./CustomTimePicker";

export type { CustomTimePickerProps, TimeInputProps };
export type TimePickerProps = CustomTimePickerProps;

export const TimePicker: React.FC<TimePickerProps> = (props) => {
  return <CustomTimePicker {...props} />;
};

TimePicker.displayName = "TimePicker";

export { CustomTimePicker, TimeInput };

