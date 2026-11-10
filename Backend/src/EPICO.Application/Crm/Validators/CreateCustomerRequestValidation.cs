using EPICO.Contracts.Crm;
using FluentValidation;

namespace EPICO.Application.Crm;

public class CreateCustomerRequestValidation : AbstractValidator<CreateCustomerRequest>
{
    public CreateCustomerRequestValidation()
    {
        RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(300);
        RuleFor(x => x.ComercialName).NotEmpty().MaximumLength(300);
        RuleFor(x => x.RFC)
            .Matches(@"^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$")
            .When(x => !string.IsNullOrWhiteSpace(x.RFC))
            .WithMessage("Invalid RFC format.");
        RuleFor(x => x.CPFiscal)
            .Matches(@"^\d{5}$")
            .When(x => !string.IsNullOrWhiteSpace(x.CPFiscal));
    }
}