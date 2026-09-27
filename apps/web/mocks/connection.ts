export interface ConnectionMock {
  status: "connected" | "disconnected" | "error";
}

export const sampleConnection: ConnectionMock = {
  status: "disconnected",
};
