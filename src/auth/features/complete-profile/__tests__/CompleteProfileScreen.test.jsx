import { describe, vi, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import CompleteProfileScreen from "../CompleteProfileScreen";

const mockUser = { email: "test@example.com", name: "" };

function renderScreen(props = {}) {
  return render(<CompleteProfileScreen user={mockUser} onComplete={vi.fn()} onSignOut={vi.fn()} {...props} />);
}

describe("CompleteProfileScreen", () => {
  qaTest("auth.complete.shows-profile-completion-fields", () => {
    renderScreen();
    expect(screen.getByPlaceholderText("Your full name")).toBeInTheDocument();
  });

  qaTest("auth.complete.happy", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    renderScreen({ onComplete });
    fireEvent.change(screen.getByPlaceholderText("Your full name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., TED University/i), {
      target: { value: "TEDU" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Your full name").closest("form"));
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({ name: "Jane Doe", orgName: "TEDU" })
    );
  });

  qaTest("auth.complete.error", async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error("Failed to save profile"));
    renderScreen({ onComplete });
    fireEvent.change(screen.getByPlaceholderText("Your full name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., TED University/i), {
      target: { value: "TEDU" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Your full name").closest("form"));
    await waitFor(() =>
      expect(screen.getByText(/failed to save profile/i)).toBeInTheDocument()
    );
  });
});
