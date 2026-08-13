export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  system_fingerprint: string | null;
  service_tier: string | null;
  prompt_logprobs: any | null;
  kv_transfer_params: any | null;

  choices: Choice[];
  usage: Usage;
};

export type Choice = {
  finish_reason: string;
  index: number;
  message: Message;
};

export type Message = {
  role: "assistant" | "user" | "system";
  content: string;
  tool_calls: any | null;
  function_call: any | null;
};

export type Usage = {
  completion_tokens: number;
  prompt_tokens: number;
  total_tokens: number;
  completion_tokens_details: any | null;
  prompt_tokens_details: any | null;
};

type RAGMetaData = {
  ai_reason: string;
  ai_formulated: string;
  category: string | "Global";
  final_question: string;
  final_score_top: string;
  original_question: string;
  wa_number: string | null;
}

type similiarQuestionData = {
  answer_id: string[] | null;
  category_id: string;
  dense_score: number;
  final_score: number;
  note: string;
  overlap_score: number;
  question: string;
  answer_doc : string | null;
}

type similiarRequestData = {
  request_id: string;
  request_name: string;
  organization_id: string;
  dense_score: number;
  final_score: number;
  note: string;
}

type RAGTiming = {
  ai_domain_sec: number;
  ai_relevance_sec: number;
  embedding_sec: number;
  qdrant_sec: number;
  total_sec: number;
}

export type RAGResponse = {
  data: {
    metadata: RAGMetaData;
    similar_questions: similiarQuestionData[];
  },
  message: string;
  status: "low_confidence" | "success";
  timing: RAGTiming

}

export type RAGRequestResponse = Omit<RAGResponse, "data"> & {
  data: Omit<RAGResponse["data"], "similar_questions"> & {
    similar_questions: similiarRequestData[];
  };
};
