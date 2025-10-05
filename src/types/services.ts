export interface ServiceItem {
  name: string;
  description: string;
  features?: string[]; // bullet points shown in the card
  category?: string; // optional canonical category
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  serviceName: string; // should reference ServiceItem.name
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface ServicesData {
  services: ServiceItem[];
  testimonials: TestimonialItem[];
}
