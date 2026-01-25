import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class ScoreExecutionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
