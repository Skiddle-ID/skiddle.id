export interface WorksHeader {
  name: string;
  title: string;
  location: string;
  email: string;
  links: {
    github?: string;
    bluesky?: string;
  };
}

export interface WorkPosition {
  role: string;
  start: string; // e.g. "2022"
  end: string;   // e.g. "Present" or "2020"
  highlights: string[];
  /** e.g. "Contract". Shown as a small badge next to the role. */
  employment?: string;
  /** Set when this is work done for a client through the company, e.g. "Undisclosed client" */
  client?: string;
}

export interface WorkExperience {
  company: string;
  /** One line under the company name, e.g. what the company is */
  description?: string;
  positions: WorkPosition[];
}

export interface EducationItem {
  degree: string;
  school: string;
  start?: string;
  end?: string;
  description?: string;
}

export interface SkillsSection {
  programmingLanguages: string[];
  devopsInfrastructure: string[];
  frameworksTools: string[];
  interests: string[];
}

export interface NotableProjectItem {
  title: string;
  description: string;
  labels: string[]; // tech badges
  live?: string;
  github?: string;
  status?: string; // e.g. Ongoing
}

export interface CertificationItem {
  title: string;
  yearOrStatus: string; // e.g. "2024" or "Expected Q1 2025"
}

export interface WorksData {
  header: WorksHeader;
  summary: string[]; // paragraphs
  experience: WorkExperience[];
  education: EducationItem[];
  skills: SkillsSection;
  projects: NotableProjectItem[];
  certifications: CertificationItem[];
}
