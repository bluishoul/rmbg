const TOKEN_KEY = "GITEE_AI_TOKEN";

export default function useToken() {
  const getToken = () => {
    const localToken = localStorage.getItem(TOKEN_KEY);
    const envToken = import.meta.env.VITE_GITEE_AI_TOKEN || "";
    return localToken || envToken;
  };

  const setToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
  };

  return {
    getToken,
    setToken,
    clearToken,
  };
}
