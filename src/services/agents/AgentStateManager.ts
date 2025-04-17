
import { AgentState } from "../types/gemini-types";

export class AgentStateManager {
  private static currentAgentState: AgentState = {
    thinking: "",
    status: "idle",
    steps: [],
    originalQuery: ""
  };

  static getCurrentAgentState(): AgentState {
    return this.currentAgentState;
  }

  static resetAgentState() {
    this.currentAgentState = {
      thinking: "",
      status: "idle",
      steps: [],
      originalQuery: ""
    };
  }

  static updateAgentThinking(thinking: string) {
    this.currentAgentState.thinking = thinking;
  }

  static updateAgentStatus(status: 'idle' | 'planning' | 'executing' | 'complete') {
    this.currentAgentState.status = status;
  }

  static setOriginalQuery(query: string) {
    this.currentAgentState.originalQuery = query;
  }

  static setSteps(steps: Array<{
    description: string;
    completed: boolean;
    result?: string;
  }>) {
    this.currentAgentState.steps = steps;
  }

  static updateStepResult(index: number, result: string) {
    if (this.currentAgentState.steps[index]) {
      this.currentAgentState.steps[index].result = result;
    }
  }

  static completeStep(index: number) {
    if (this.currentAgentState.steps[index]) {
      this.currentAgentState.steps[index].completed = true;
    }
  }
}
