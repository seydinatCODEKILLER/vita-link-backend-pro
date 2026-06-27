import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidJson', async: false })
export class IsValidJsonConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Les critères doivent être un JSON valide (ex: {"minDonations": 3})';
  }
}
