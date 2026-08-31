"use client";

import React from "react";
import { CustomDatePicker, CustomDatePickerProps } from "./CustomDatePicker";

export type DatePickerProps = CustomDatePickerProps;

export const DatePicker: React.FC<DatePickerProps> = (props) => {
  return <CustomDatePicker {...props} />;
};

DatePicker.displayName = "DatePicker";

export { CustomDatePicker };
