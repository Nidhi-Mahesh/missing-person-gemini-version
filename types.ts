
export interface Person {
  id: string;
  name: string;
  age: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  lastSeenClothing: string; // New field for user-reported clothing
  description: string; // Biometric description (AI generated, excluding clothes)
  imageUrl: string; // Base64 or URL
  status: 'MISSING' | 'FOUND' | 'SIGHTED';
}

export interface MatchResult {
  found: boolean;
  confidence: number;
  description: string;
  timestamp: string;
  locationContext?: string;
  boundingBox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

export enum AppView {
  REPORT = 'REPORT',
  DIRECTORY = 'DIRECTORY',
  SCAN = 'SCAN',
}
