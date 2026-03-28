// This file is responsible for chat query

const baseUrl = import.meta.env.VITE_PYTHON_BACKEND_URL || "http://127.0.0.1:8080";

export const chat = async (question) => {
  try {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ question: question }),
    });

    if (!response.ok) {
      throw new Error("Error while querying !!");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
};