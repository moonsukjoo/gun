import { format } from 'date-fns';

// Known public holidays in Korea for 2024 to 2026
const FIXED_HOLIDAYS = [
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
];

// Dynamic/Lunar holidays mapped by YYYY-MM-DD
const LUNAR_HOLIDAYS: Record<string, string> = {
  // 2024
  '2024-02-09': '설날',
  '2024-02-10': '설날',
  '2024-02-11': '설날',
  '2024-02-12': '대체공휴일(설날)',
  '2024-05-15': '부처님오신날',
  '2024-09-16': '추석',
  '2024-09-17': '추석',
  '2024-09-18': '추석',
  // 2025
  '2025-01-28': '설날',
  '2025-01-29': '설날',
  '2025-01-30': '설날',
  '2025-03-03': '대체공휴일(삼일절)',
  '2025-05-06': '대체공휴일(어린이날/부처님오신날)',
  '2025-10-05': '추석',
  '2025-10-06': '추석',
  '2025-10-07': '추석',
  '2025-10-08': '대체공휴일(추석)',
  // 2026
  '2026-02-16': '설날',
  '2026-02-17': '설날',
  '2026-02-18': '설날',
  '2026-05-24': '부처님오신날',
  '2026-09-24': '추석',
  '2026-09-25': '추석',
  '2026-09-26': '추석',
  '2026-05-25': '대체공휴일(부처님오신날)',
};

/**
 * Checks if a given date is a Korean public holiday or a weekend (Sat/Sun).
 */
export function checkIsSpecialDay(date: Date, manualSpecialDates: Record<string, any> = {}): { isSpecial: boolean; label?: string } {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // 1. Check manual override dates first (configured by management user)
  if (manualSpecialDates[dateStr]) {
    return { isSpecial: true, label: manualSpecialDates[dateStr].label || '특별 1.5배 근무일' };
  }

  // 2. Check fixed date holidays (MM-DD)
  const mmDd = format(date, 'MM-dd');
  if (FIXED_HOLIDAYS.includes(mmDd)) {
    let label = '공휴일';
    if (mmDd === '01-01') label = '신정';
    else if (mmDd === '03-01') label = '삼일절';
    else if (mmDd === '05-05') label = '어린이날';
    else if (mmDd === '06-06') label = '현충일';
    else if (mmDd === '08-15') label = '광복절';
    else if (mmDd === '10-03') label = '개천절';
    else if (mmDd === '10-09') label = '한글날';
    else if (mmDd === '12-25') label = '성탄절';
    return { isSpecial: true, label };
  }

  // 3. Check Lunar/Dynamic holidays (YYYY-MM-DD)
  if (LUNAR_HOLIDAYS[dateStr]) {
    return { isSpecial: true, label: LUNAR_HOLIDAYS[dateStr] };
  }

  // 4. Check weekends (Saturday=6, Sunday=0)
  const day = date.getDay();
  if (day === 0) {
    return { isSpecial: true, label: '일요일' };
  }
  if (day === 6) {
    return { isSpecial: true, label: '토요일' };
  }

  return { isSpecial: false };
}
