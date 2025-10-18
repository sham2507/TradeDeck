
async def make_get_request(session, url, params=None, headers=None, timeout=10, semaphore=None):
    try:
        if semaphore:
            async with semaphore:
                response = await session.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=timeout
                )
        else:
            response = await session.get(
                url,
                params=params,
                headers=headers,
                timeout=timeout
            )

        res_json = await response.json()
        # print(res_json)
        response.raise_for_status()
        return res_json

    except Exception as e:
        print(f"Request failed: {e}")
        raise