'use client';

import { MapPin } from 'lucide-react';

export interface AddressState {
  id: number;
  name: string;
}

export interface AddressValues {
  street: string;
  city: string;
  district: string;
  state_id: number | '';
  pincode: string;
}

interface AddressFieldsProps {
  values: AddressValues;
  onChange: (values: AddressValues) => void;
  errors?: Partial<Record<keyof AddressValues, string>>;
  states: AddressState[];
  disabled?: boolean;
}

export function AddressFields({ values, onChange, errors, states, disabled }: AddressFieldsProps) {
  const handleChange = (field: keyof AddressValues, value: string | number) => {
    onChange({ ...values, [field]: value });
  };

  const inputClass = "w-full border border-[#ebebeb] rounded-sm px-3 py-2 text-sm text-[#171717] bg-[#fafafa] focus:outline-none focus:border-[#6b7280] disabled:opacity-50 transition-colors";
  const labelClass = "block text-xs font-medium text-[#6b7280] mb-1";
  const errorClass = "text-xs text-red-500 mt-1";

  return (
    <div className="space-y-4">
      {/* Street */}
      <div>
        <label className={labelClass}>Street / Area *</label>
        <input
          type="text"
          value={values.street}
          onChange={(e) => handleChange('street', e.target.value)}
          disabled={disabled}
          className={inputClass}
          placeholder="e.g. Plot 42, Sector 18"
        />
        {errors?.street && <p className={errorClass}>{errors.street}</p>}
      </div>

      {/* City and District */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>City / Town / Village *</label>
          <input
            type="text"
            value={values.city}
            onChange={(e) => handleChange('city', e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="e.g. Pune"
          />
          {errors?.city && <p className={errorClass}>{errors.city}</p>}
        </div>
        <div>
          <label className={labelClass}>District *</label>
          <input
            type="text"
            value={values.district}
            onChange={(e) => handleChange('district', e.target.value)}
            disabled={disabled}
            className={inputClass}
            placeholder="e.g. Pune"
          />
          {errors?.district && <p className={errorClass}>{errors.district}</p>}
        </div>
      </div>

      {/* State and Pincode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>State *</label>
          <select
            value={values.state_id}
            onChange={(e) => handleChange('state_id', e.target.value ? Number(e.target.value) : '')}
            disabled={disabled}
            className={inputClass}
          >
            <option value="" disabled>Select State</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.name}
              </option>
            ))}
          </select>
          {errors?.state_id && <p className={errorClass}>{errors.state_id}</p>}
        </div>
        <div>
          <label className={labelClass}>Pincode *</label>
          <input
            type="text"
            value={values.pincode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              handleChange('pincode', val);
            }}
            disabled={disabled}
            className={inputClass}
            placeholder="411001"
            maxLength={6}
          />
          {errors?.pincode && <p className={errorClass}>{errors.pincode}</p>}
        </div>
      </div>
    </div>
  );
}
