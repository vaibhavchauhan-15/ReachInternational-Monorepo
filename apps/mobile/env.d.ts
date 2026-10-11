/// <reference types="nativewind/types" />

declare var process: {
  env: {
    [key: string]: string | undefined;
  };
};

declare module '*.css' {
  const content: any;
  export default content;
}

