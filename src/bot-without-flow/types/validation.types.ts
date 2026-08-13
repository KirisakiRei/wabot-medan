import { IsString } from "class-validator";

export class QuestionRagPayload {
    @IsString()
    question: string;

    @IsString()
    question_id: string;

    @IsString()
    answer_id : string;

    @IsString()
    category_id : string;
}

export class RequestRagPayload {
    @IsString()
    request: string;

    @IsString()
    request_id: string;

    @IsString()
    organization_id : string;

}

export class GenerateBank {
    organization_id : string;
    user_message : string;
}