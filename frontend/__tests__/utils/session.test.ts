import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import api, { AUTH_EXPIRED_EVENT, TOKEN_KEY } from "../../utils/api";

function respondWith401() {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const err = new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config);
    err.response = { status: 401, data: { detail: "nope" }, statusText: "", headers: {}, config };
    throw err;
  };
}

describe("signing out when the server rejects the stored token", () => {
  let expired: jest.Mock;

  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, "stored-token");
    expired = jest.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    respondWith401();
  });

  afterEach(() => {
    window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
    localStorage.clear();
  });

  it("clears the token when a request is rejected with 401", async () => {
    await expect(api.get("/auth/me")).rejects.toThrow();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when a sign-in attempt fails", async () => {
    await expect(api.post("/auth/login", { username: "a", password: "b" })).rejects.toThrow();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("stored-token");
    expect(expired).not.toHaveBeenCalled();
  });
});
