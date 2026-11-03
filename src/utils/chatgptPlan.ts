export const ChatGptPlan = {
  getStatus: async (): Promise<{ email?: string } | undefined> => undefined,
  signIn: async (): Promise<{ email?: string }> => {
    throw new Error("ChatGPT 요금제 연결은 모바일 앱에서 사용할 수 있습니다.");
  },
  getAccessToken: async (): Promise<string> => {
    throw new Error("ChatGPT 요금제 연결은 모바일 앱에서 사용할 수 있습니다.");
  },
  signOut: async (): Promise<boolean> => true,
};
