import { createApiCompatibleRepository, timeRepository } from "./repository.js";

function createJsonApiClient(baseUrl) {
  async function request(path, init) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...init,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  return {
    get(path) {
      return request(path);
    },
    post(path, body) {
      return request(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  };
}

const configuredApiBase = window.__TIME_ANALYZER_API_BASE__;

export const activeRepository = configuredApiBase
  ? createApiCompatibleRepository(createJsonApiClient(configuredApiBase))
  : timeRepository;

export const repositoryModeLabel = configuredApiBase ? "API Live" : "Dummy + Local";
