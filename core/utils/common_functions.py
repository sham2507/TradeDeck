def generate_option_names(base_string):
    # Split the string into parts
    parts = base_string.split()
    # Ensure we have exactly 3 parts (index, date, strike price)
    if len(parts) != 3:
        raise ValueError("Input string must be in format 'INDEX DATE STRIKEPRICE'")

    index, date, strike = parts

    # Generate both CE and PE variants
    ce_option = f"{index} {date} CE {strike}"
    pe_option = f"{index} {date} PE {strike}"

    return [ce_option, pe_option]

def get_price_using_id(id,option_price) :
    for price in option_price :
        if str(price['id']) == id:
            return price['price']

    return 0

def get_instrument_id_by_option_name(option_name,option_details):
    for item in option_details:
        if item.get('optionName') == option_name:
            return item.get('instrumentId')
    return None


def get_index_price(index_name, index_price):
    for data in index_price :
        if data['name'] == index_name:
            return data['price']
    return 0