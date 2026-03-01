import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const COUNTRY_CODE_TO_ISO: Record<string, CountryCode> = {
  '51': 'PE',
  '34': 'ES',
  '52': 'MX',
  '57': 'CO',
  '58': 'VE',
};

export function onlyDigits(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '');
}

export interface NormalizedLeadPhone {
  countryCode: string;
  nationalNumber: string;
  e164: string;
}

export function normalizeLeadPhone(countryCodeInput: string, nationalNumberInput: string): NormalizedLeadPhone {
  const countryCode = onlyDigits(countryCodeInput);
  const nationalNumber = onlyDigits(nationalNumberInput);
  const iso2 = COUNTRY_CODE_TO_ISO[countryCode];

  if (!countryCode || !nationalNumber) {
    return {
      countryCode,
      nationalNumber,
      e164: '',
    };
  }

  if (iso2) {
    const parsedLocal = parsePhoneNumberFromString(nationalNumber, iso2);
    if (parsedLocal?.isValid()) {
      return {
        countryCode: parsedLocal.countryCallingCode,
        nationalNumber: parsedLocal.nationalNumber,
        e164: parsedLocal.number,
      };
    }
  }

  const candidate = `+${countryCode}${nationalNumber}`;
  const parsedInternational = parsePhoneNumberFromString(candidate);
  if (parsedInternational?.isValid()) {
    return {
      countryCode: parsedInternational.countryCallingCode,
      nationalNumber: parsedInternational.nationalNumber,
      e164: parsedInternational.number,
    };
  }

  return {
    countryCode,
    nationalNumber,
    e164: candidate,
  };
}
