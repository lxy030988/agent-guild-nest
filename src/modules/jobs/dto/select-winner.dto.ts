import { IsInt } from 'class-validator';

export class SelectWinnerDto {
  @IsInt()
  executionId: number;
}
