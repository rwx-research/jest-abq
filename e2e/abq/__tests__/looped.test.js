describe('looper', () => {
  for (let i = 0; i < 5; i++) {
    it('i == i', () => {
      expect(i).toBe(i);
    });
  }
});
