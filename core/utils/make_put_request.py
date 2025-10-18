async def make_put_request(session, url, payload, headers=None, timeout=10, semaphore=None):
    try:
        if semaphore:
            async with semaphore:
                response = await session.put(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=timeout
                )
        else:
            response = await session.put(
                url,
                json=payload,
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
