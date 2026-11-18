const { trailingSlashUrl } = require('./trailingSlash');

describe('trailingSlashUrl', () => {
  it('adds the trailing slash to SEO paths', () => {
    expect(trailingSlashUrl('/jdm-cars')).toEqual('/jdm-cars/');
    expect(trailingSlashUrl('/jdm-cars/honda')).toEqual('/jdm-cars/honda/');
    expect(trailingSlashUrl('/jdm-cars/honda/civic/page-2')).toEqual(
      '/jdm-cars/honda/civic/page-2/'
    );
    expect(trailingSlashUrl('/jdm-parts/universal')).toEqual('/jdm-parts/universal/');
    expect(trailingSlashUrl('/vic')).toEqual('/vic/');
    expect(trailingSlashUrl('/int/page-3')).toEqual('/int/page-3/');
    expect(trailingSlashUrl('/jdm-cars/nissan/silvia/vic/page-2')).toEqual(
      '/jdm-cars/nissan/silvia/vic/page-2/'
    );
  });

  it('keeps the query string', () => {
    expect(trailingSlashUrl('/jdm-cars/honda?pub_transmission=manual')).toEqual(
      '/jdm-cars/honda/?pub_transmission=manual'
    );
  });

  it('leaves other URLs alone', () => {
    expect(trailingSlashUrl('/jdm-cars/')).toBeNull();
    expect(trailingSlashUrl('/jdm-cars/honda/?page=2')).toBeNull();
    expect(trailingSlashUrl('/s')).toBeNull();
    expect(trailingSlashUrl('/login')).toBeNull();
    expect(trailingSlashUrl('/l/some-listing/123')).toBeNull();
    expect(trailingSlashUrl('/victoria')).toBeNull();
    expect(trailingSlashUrl('/jdm-cars/a/b/c/d/e')).toBeNull();
  });
});
