declare module 'bcryptjs' {
  export function hash(s: string, salt: number | string): Promise<string>;
  export function hashSync(s: string, salt?: number | string): string;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function compareSync(s: string, hash: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  export function getRounds(hash: string): number;
  const bcrypt: {
    hash(s: string, salt: number | string): Promise<string>;
    hashSync(s: string, salt?: number | string): string;
    compare(s: string, hash: string): Promise<boolean>;
    compareSync(s: string, hash: string): boolean;
    genSalt(rounds?: number): Promise<string>;
    genSaltSync(rounds?: number): string;
    getRounds(hash: string): number;
  };
  export default bcrypt;
}
