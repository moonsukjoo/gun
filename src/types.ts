export type Role = 'CEO' | 'DIRECTOR' | 'GENERAL_AFFAIRS' | 'GENERAL_MANAGER' | 'CLERK' | 'SAFETY_MANAGER' | 'TEAM_LEADER' | 'EMPLOYEE';

export interface UserProfile {
  uid: string;
  employeeId: string;
  email: string;
  displayName: string;
  role: Role;
  departmentId?: string; // Changed from department string to ID
  departmentName?: string;
  position?: string;
  jobRole?: string; // e.g., 취부, 용접 등
  workplace?: string; // e.g., 울산조선소, 부산공장 등
  phoneNumber?: string;
  annualLeaveBalance?: number;
  points?: number;
  joinedAt?: string;
  resignedAt?: string;
  isActive: boolean;
  permissions?: string[]; // permissions for specific features
  hasCustomPin?: boolean;
  lastPinChange?: string;
  elderlyMode?: boolean;
}

export interface Department {
  id: string;
  name: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  uid: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
  healthStatus?: 'GOOD' | 'NORMAL' | 'BAD';
  workHours?: number; // Total hours including overtime
  overtimeHours?: number; // Overtime hours
  memo?: string;
  leaveType?: 'ANNUAL' | 'AM_HALF' | 'PM_HALF';
}

export interface AccidentCase {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'SAFE' | 'INCIDENT' | 'ACCIDENT' | 'OTHER';
  measures?: string;
  reportedByUid: string;
  reportedBy: string;
  imageUrl?: string;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  uid: string;
  type: 'ANNUAL' | 'SICK' | 'SPECIAL' | 'AM_HALF' | 'PM_HALF' | 'OTHER';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  targetDept: string;
  createdAt: string;
  isImportant: boolean;
}

export interface Notification {
  id: string;
  uid: string; // Target user
  title: string;
  message: string;
  type: 'HEALTH_CHECK' | 'NOTICE' | 'SYSTEM' | 'LEAVE_REMINDER' | 'COUPON' | 'EMERGENCY';
  isRead: boolean;
  createdAt: string;
  fromUid?: string;
  fromName?: string;
}

export interface LottoHistory {
  id: string;
  uid: string;
  lines: string[]; // Store as ["1,2,3,4,5,6,7", ...] to avoid Firestore nested array error
  createdAt: string;
}

export interface PraiseCoupon {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: Role;
  receiverUid: string;
  receiverName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  reason: string;
  points: number;
  createdAt: string;
}
