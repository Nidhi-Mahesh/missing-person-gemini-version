
export interface Person {
  id: string;
  name: string;
  age: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  description: string;
  imageUrl: string; // Base64 or URL
  status: 'MISSING' | 'FOUND' | 'SIGHTED';
}

export interface MatchResult {
  found: boolean;
  confidence: number;
  description: string;
  timestamp: string;
  locationContext?: string;
}

export enum AppView {
  REPORT = 'REPORT',
  DIRECTORY = 'DIRECTORY',
  SCAN = 'SCAN',
}
