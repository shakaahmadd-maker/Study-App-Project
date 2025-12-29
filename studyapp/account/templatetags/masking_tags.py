from django import template
from account.utils import generate_masked_link

register = template.Library()

@register.simple_tag(takes_context=True)
def mask_link(context, target_url, link_type=None):
    request = context.get('request')
    if not request or not request.user.is_authenticated:
        return target_url
    
    # Only mask for teachers as per requirement
    if request.user.role == 'TEACHER':
        return generate_masked_link(request.user, target_url, link_type)
    
    return target_url

