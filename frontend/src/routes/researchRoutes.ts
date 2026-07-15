export const AI_RESEARCH_PATH = '/agent';
export const RESEARCH_CANDIDATES_PATH = '/agent/candidates';
export const RESEARCH_REVIEW_PATH = '/agent/review';

export const researchPipelinePath = (stageId = 'research-pipeline') => (
  `${AI_RESEARCH_PATH}#${stageId}`
);
