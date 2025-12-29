// Pricing Calculator Functionality
document.addEventListener('DOMContentLoaded', function () {
    const calculateBtn = document.getElementById('calculateQuote');
    const quoteResult = document.getElementById('quoteResult');
    const quoteAmount = document.getElementById('quoteAmount');
    const quoteDetails = document.getElementById('quoteDetails');

    // Pricing structure
    const pricingStructure = {
        essay: { base: 15, multiplier: 1.0 },
        research: { base: 20, multiplier: 1.2 },
        dissertation: { base: 30, multiplier: 1.5 },
        presentation: { base: 25, multiplier: 1.1 },
        homework: { base: 10, multiplier: 0.8 }
    };

    const urgencyMultipliers = {
        7: 1.0,    // Standard
        3: 1.3,    // Rush
        1: 1.6,    // Urgent
        0.5: 2.0   // Emergency
    };

    const academicLevelMultipliers = {
        highschool: 1.0,
        undergraduate: 1.2,
        masters: 1.5,
        phd: 2.0
    };

    function calculateQuote() {
        const assignmentType = document.getElementById('assignmentType').value;
        const pages = parseInt(document.getElementById('pages').value);
        const urgency = parseFloat(document.getElementById('urgency').value);
        const academicLevel = document.getElementById('academicLevel').value;

        // Calculate base price
        const basePrice = pricingStructure[assignmentType].base;
        const typeMultiplier = pricingStructure[assignmentType].multiplier;
        const urgencyMultiplier = urgencyMultipliers[urgency];
        const levelMultiplier = academicLevelMultipliers[academicLevel];

        // Calculate total price
        let totalPrice = basePrice * pages * typeMultiplier * urgencyMultiplier * levelMultiplier;

        // Round to nearest dollar
        totalPrice = Math.round(totalPrice);

        // Display result
        quoteAmount.textContent = `$${totalPrice}`;

        const urgencyText = urgency === 7 ? 'Standard' :
            urgency === 3 ? 'Rush' :
                urgency === 1 ? 'Urgent' : 'Emergency';

        quoteDetails.textContent = `${pages} page${pages > 1 ? 's' : ''} ${assignmentType} at ${academicLevel} level with ${urgencyText} delivery`;

        quoteResult.classList.remove('hidden');

        // Smooth scroll to result
        quoteResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Event listener for calculate button
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculateQuote);
    }

    // Real-time calculation on input change
    const inputs = ['assignmentType', 'pages', 'urgency', 'academicLevel'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', calculateQuote);
            input.addEventListener('input', calculateQuote);
        }
    });

    // Initialize calculation on page load
    calculateQuote();
});
