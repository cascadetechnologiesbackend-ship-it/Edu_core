// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyllabusDetailModal } from "../SyllabusDetailModal";

const sampleData = {
  termName: "Term 1 (2026-27)",
  subjects: [
    {
      subjectId: "sub-math",
      subjectName: "Mathematics",
      completedTopicsCount: 8,
      totalTopicsCount: 10,
      progressPercent: 80,
      units: [
        {
          unitNumber: 1,
          title: "Algebra & Polynomials",
          chapters: [
            {
              chapterNumber: 1,
              title: "Linear Equations in Two Variables",
              topics: [
                { id: "t1", topicNumber: 1, title: "Graphing Lines", isTaught: true },
                { id: "t2", topicNumber: 2, title: "Elimination Method", isTaught: false },
              ],
            },
          ],
        },
      ],
    },
    {
      subjectId: "sub-sci",
      subjectName: "Science",
      completedTopicsCount: 5,
      totalTopicsCount: 10,
      progressPercent: 50,
      units: [
        {
          unitNumber: 1,
          title: "Chemical Reactions",
          chapters: [
            {
              chapterNumber: 1,
              title: "Acids and Bases",
              topics: [
                { id: "t3", topicNumber: 1, title: "pH Scale", isTaught: true },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("SyllabusDetailModal Hook Ordering & State Regression Tests", () => {
  it("renders null when data is null, undefined, or empty subjects", () => {
    const { container: c1 } = render(
      <SyllabusDetailModal open={true} onClose={vi.fn()} data={null} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <SyllabusDetailModal open={true} onClose={vi.fn()} data={{ subjects: [] }} />
    );
    expect(c2.firstChild).toBeNull();
  });

  it("renders null when open is false even if data is valid", () => {
    const { container } = render(
      <SyllabusDetailModal open={false} onClose={vi.fn()} data={sampleData} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("initializes with initialSubjectId when provided", () => {
    render(
      <SyllabusDetailModal
        open={true}
        onClose={vi.fn()}
        data={sampleData}
        initialSubjectId="sub-sci"
      />
    );

    expect(screen.getByText(/Chemical Reactions/)).toBeDefined();
    expect(screen.getByText(/Acids and Bases/)).toBeDefined();
    expect(screen.getByText("pH Scale")).toBeDefined();
  });

  it("handles asynchronous data arrival from null to populated without hook errors", () => {
    const { rerender } = render(
      <SyllabusDetailModal open={true} onClose={vi.fn()} data={null} />
    );

    // Async data arrives
    rerender(
      <SyllabusDetailModal open={true} onClose={vi.fn()} data={sampleData} />
    );

    // Defaults to first subject (Mathematics)
    expect(screen.getByText(/Algebra & Polynomials/)).toBeDefined();
    expect(screen.getByText("Graphing Lines")).toBeDefined();
  });

  it("preserves manual subject selection when updated data arrives", () => {
    const { rerender } = render(
      <SyllabusDetailModal open={true} onClose={vi.fn()} data={sampleData} />
    );

    // User switches to Science
    const scienceTab = screen.getByRole("button", { name: /Science/i });
    fireEvent.click(scienceTab);

    expect(screen.getByText(/Chemical Reactions/)).toBeDefined();
    expect(screen.getByText(/Acids and Bases/)).toBeDefined();

    // Fresh updated data arrives containing Science
    const updatedData = {
      ...sampleData,
      subjects: sampleData.subjects.map((s) =>
        s.subjectId === "sub-sci"
          ? { ...s, completedTopicsCount: 6, progressPercent: 60 }
          : s
      ),
    };

    rerender(
      <SyllabusDetailModal open={true} onClose={vi.fn()} data={updatedData} />
    );

    // User selection of Science is preserved!
    expect(screen.getByText(/Chemical Reactions/)).toBeDefined();
    expect(screen.getByText(/Acids and Bases/)).toBeDefined();
  });
});
