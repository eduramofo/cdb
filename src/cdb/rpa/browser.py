from playwright.async_api import Browser, BrowserContext, Page, async_playwright


async def launch_browser(headed: bool = False) -> tuple[Browser, BrowserContext, Page]:
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=not headed,
        args=["--no-sandbox", "--disable-setuid-sandbox"],
    )
    context = await browser.new_context(
        viewport={"width": 1280, "height": 900},
        locale="en-US",
    )
    page = await context.new_page()
    page.set_default_timeout(30_000)
    return browser, context, page
