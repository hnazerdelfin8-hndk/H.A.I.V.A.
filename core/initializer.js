// =========================================
// H.A.I.V.A. Initializer
// =========================================

import {
  registerSkill,
  getSkills
} from "./skill-manager.js";


// =========================================
// Initialize H.A.I.V.A.
// =========================================

export async function initializeHAIVA() {

  console.log(
    "Initializing H.A.I.V.A. systems..."
  );


  // =======================================
  // Greeting Skill
  // =======================================

  registerSkill(
    "greeting",
    {

      canHandle(command) {

        return (
          command.includes("hello") ||
          command.includes("hi") ||
          command.includes("kumusta")
        );

      },

      async execute() {

        return "Hello, Master. How can I help you?";

      }

    }
  );


  // =======================================
  // Identity Skill
  // =======================================

  registerSkill(
    "identity",
    {

      canHandle(command) {

        return (
          command.includes("who are you") ||
          command.includes("sino ka")
        );

      },

      async execute() {

        return (
          "I am H.A.I.V.A., " +
          "your intelligent virtual assistant."
        );

      }

    }
  );


  // =======================================
  // Initialization Complete
  // =======================================

  const skills = getSkills();

  console.log(
    "H.A.I.V.A. skills loaded:",
    skills
  );


  return {

    ready: true,

    skills: skills

  };

}
