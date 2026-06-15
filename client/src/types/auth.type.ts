export type RegisterType = {
  name: string;
  email: string;
  password: string;
  avatar?: string;
};
 
export type LoginType = {
  email: string;
  password: string;
};
 
export interface UserType {
  _id: string;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string; // NEW
  isAI?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
 
// NEW — update profile payload
export type UpdateProfileType = {
  name?: string;
  bio?: string;
  avatar?: string; // base64 image
};
 